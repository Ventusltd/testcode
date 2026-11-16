"""Bounded synthetic projected-XY numerical test; never a connection estimate."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import sys
import time
import numpy as np

MAX_QUERIES, MAX_CANDIDATES = 512, 1024
POOL_LIMIT = 64 * 1024 * 1024
ATOL, RTOL = 1e-10, 1e-12  # squared projected metres


def inputs(queries, candidates):
    # Reject prior float32 loss; promoting it does not recover centimetres.
    q, p = np.asarray(queries), np.asarray(candidates)
    if q.dtype != np.float64 or p.dtype != np.float64:
        raise ValueError('original float64 inputs required')
    for value, maximum in ((q, MAX_QUERIES), (p, MAX_CANDIDATES)):
        if value.ndim != 2 or value.shape[1] != 2 or not 0 < len(value) <= maximum:
            raise ValueError('bounded nonempty Nx2 inputs required')
        if not np.isfinite(value).all() or np.abs(value).max() > 1e9:
            raise ValueError('finite bounded projected coordinates required')
    return q, p


def scalar_nearest(queries, candidates):
    q, p = inputs(queries, candidates)
    indexes, squared = [], []
    for x, y in q:
        # Independent scalar libm norm; strict comparison keeps the first tie.
        values = [math.hypot(float(px)-float(x), float(py)-float(y)) ** 2 for px, py in p]
        index = min(range(len(values)), key=values.__getitem__)
        indexes.append(index)
        squared.append(values[index])
    return np.asarray(indexes, dtype=np.int64), np.asarray(squared, dtype=np.float64)


def subtract_first(xp, q, p):
    dx = q[:, None, 0] - p[None, :, 0]
    dy = q[:, None, 1] - p[None, :, 1]
    squared = dx * dx + dy * dy
    indexes = xp.argmin(squared, axis=1)  # first array index on an exact tie
    return indexes, squared[xp.arange(len(q)), indexes]


def bad_float32_dot(xp, q, p):
    """Deliberately unsafe counterexample, never the proposed calculation."""
    q, p = xp.asarray(q, dtype=xp.float32), xp.asarray(p, dtype=xp.float32)
    dot = q[:, None, 0]*p[None, :, 0] + q[:, None, 1]*p[None, :, 1]
    squared = xp.sum(q*q, axis=1)[:, None] + xp.sum(p*p, axis=1)[None, :] - 2*dot
    indexes = xp.argmin(squared, axis=1)
    return indexes, squared[xp.arange(len(q)), indexes]


def verify(actual, expected):
    indexes, squared = actual
    if not np.issubdtype(indexes.dtype, np.integer) or not np.array_equal(indexes, expected[0]):
        raise ValueError('nearest identity mismatch')
    if squared.shape != expected[1].shape or not np.isfinite(squared).all() or (squared < 0).any() or not np.allclose(squared, expected[1], atol=ATOL, rtol=RTOL):
        raise ValueError('distance mismatch')


def fixtures():
    return [
        ('large-offset-cancellation', np.array([[530000., 180000.]]), np.array([[530001., 180000.], [530000.125, 180000.125], [530010., 180000.]])),
        ('centimetre-input-loss', np.array([[530000., 180000.]]), np.array([[530000.02, 180000.], [530000.01, 180000.]])),
        ('negative-cancellation', np.array([[530000., 180000.]]), np.array([[529999., 180000.]])),
        ('first-index-tie', np.array([[0., 0.]]), np.array([[1., 0.], [-1., 0.]])),
        ('near-tie-distinct', np.array([[530000., 180000.]]), np.array([[530001.0000001, 180000.], [530001., 180000.]])),
    ]


def corpus(nq=128, nc=256):
    if not 1 <= nq <= MAX_QUERIES or not 3 <= nc <= MAX_CANDIDATES:
        raise ValueError('invalid requested fixture size')
    rng = np.random.default_rng(20261116)
    q = np.array([530000., 180000.]) + rng.uniform(-100, 100, (nq, 2))
    p = np.array([530000., 180000.]) + rng.uniform(-100, 100, (nc, 2))
    q[0] = fixtures()[0][1][0]
    p[:3] = fixtures()[0][2]
    return inputs(q, p)


def timed(function):
    start = time.perf_counter()
    value = function()
    return value, (time.perf_counter()-start)*1000


def run(nq=128, nc=256, gpu=False):
    started = time.perf_counter()
    q, p = corpus(nq, nc)
    expected, scalar_ms = timed(lambda: scalar_nearest(q, p))
    np_result, numpy_cold = timed(lambda: subtract_first(np, q, p))
    verify(np_result, expected)
    numpy_warm = [timed(lambda: subtract_first(np, q, p))[1] for _ in range(3)]
    bad = bad_float32_dot(np, q, p)
    bad_ids = int(np.count_nonzero(bad[0] != expected[0]))
    fixture_results = []
    for name, fq, fp in fixtures():
        witness = scalar_nearest(fq, fp)
        verify(subtract_first(np, fq, fp), witness)
        try:
            verify(bad_float32_dot(np, fq, fp), witness)
            rejected = False
        except ValueError:
            rejected = True
        fixture_results.append({'name': name, 'float64_pass': True, 'bad_float32_rejected': rejected})
    # At least the explicit input-quantisation fixture must detect the bad path.
    if not next(r for r in fixture_results if r['name']=='centimetre-input-loss')['bad_float32_rejected']:
        raise ValueError('counterexample did not detect precision loss')
    result = {'schema':'testcode.projected-distance.v1', 'fixture':'synthetic projected metres; not real sites',
              'queries':nq,'candidates':nc,'distinct_pairs':nq*nc,'warm_repeats':3,
              'input_sha256':hashlib.sha256(q.tobytes()+p.tobytes()).hexdigest(),
              'numpy':np.__version__,'python':sys.version.split()[0],
              'tolerance_squared_metres':{'atol':ATOL,'rtol':RTOL},'tie_rule':'first candidate array index',
              'cpu':{'parity':'PASS','scalar_ms':scalar_ms,'numpy_first_ms':numpy_cold,
                     'numpy_warm_median_ms':statistics.median(numpy_warm),'bad_float32_identity_mismatches':bad_ids},
              'fixtures':fixture_results,'gpu':{'status':'NOT_REQUESTED'},
              'limits':['Synthetic Euclidean XY only; no CRS conversion, geodesic distance, physical connection, headroom, browser or release claim.',
                        'Small three-repeat shared-device timing is not production throughput or a whole-application acceleration claim.']}
    if gpu:
        gpu_started = time.perf_counter()
        try:
            import cupy as cp
            device = cp.cuda.Device(0)
            free, total = device.mem_info
            if free < 2*POOL_LIMIT:
                result['gpu']={'status':'DEFERRED','reason':'insufficient_free_memory'}
                return result
            cp.get_default_memory_pool().set_limit(size=POOL_LIMIT)
            props=cp.cuda.runtime.getDeviceProperties(0)
            def sync(): cp.cuda.Stream.null.synchronize()
            def transfer():
                dq,dp=cp.asarray(q),cp.asarray(p)
                sync()
                return dq,dp
            (dq,dp), upload_ms=timed(transfer)
            def resident():
                answer=subtract_first(cp,dq,dp)
                sync()
                return answer
            answer,cold_ms=timed(resident)
            def download(answer):
                host=tuple(cp.asnumpy(a) for a in answer)
                sync()
                return host
            host,download_ms=timed(lambda:download(answer))
            verify(host,expected)
            warm=[timed(resident)[1] for _ in range(3)]
            def roundtrip():
                aq,ap=transfer()
                got=subtract_first(cp,aq,ap)
                return download(got)
            roundtrip_times=[]
            for _ in range(3):
                host,elapsed=timed(roundtrip)
                verify(host,expected)
                roundtrip_times.append(elapsed)
            gpu_fixture=[]
            for name,fq,fp in fixtures():
                verify(download(subtract_first(cp,cp.asarray(fq),cp.asarray(fp))),scalar_nearest(fq,fp))
                try:
                    verify(download(bad_float32_dot(cp,fq,fp)),scalar_nearest(fq,fp))
                    rejected=False
                except ValueError: rejected=True
                gpu_fixture.append({'name':name,'float64_pass':True,'bad_float32_rejected':rejected})
            name=props['name'];name=name.decode() if isinstance(name,bytes) else name
            result['gpu']={'status':'PASS','device':name,'cupy':cp.__version__,
                'cuda_runtime':cp.cuda.runtime.runtimeGetVersion(),'cuda_driver_api':cp.cuda.runtime.driverGetVersion(),
                'free_bytes_before':free,'total_bytes':total,'other_memory_used_bytes':total-free,
                'shared_device_not_exclusive':True,'process_pool_limit_bytes':POOL_LIMIT,
                'upload_ms':upload_ms,'first_kernel_and_compile_ms':cold_ms,'download_ms':download_ms,
                'warm_resident_median_ms':statistics.median(warm),
                'warm_transfer_inclusive_median_ms':statistics.median(roundtrip_times),
                'cold_setup_and_full_validation_ms':(time.perf_counter()-gpu_started)*1000,
                'cpu_witness_queries':nq,'fixtures':gpu_fixture}
        except (ImportError, cp.cuda.runtime.CUDARuntimeError if 'cp' in locals() else ImportError):
            result['gpu']={'status':'UNAVAILABLE','reason':'cupy_or_runtime_unavailable'}
    result['experiment_total_ms']=(time.perf_counter()-started)*1000
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queries',type=int,default=128)
    parser.add_argument('--candidates',type=int,default=256)
    parser.add_argument('--gpu',action='store_true')
    parser.add_argument('--out',type=Path)
    args=parser.parse_args()
    if args.out and args.out.exists(): raise ValueError('receipt already exists')
    result=run(args.queries,args.candidates,args.gpu)
    result['provenance']=json.loads(Path(__file__).with_name('pins.json').read_text())
    result['script_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    text=json.dumps(result,indent=2,allow_nan=False)+'\n'
    if args.out:
        with args.out.open('x',encoding='utf-8') as stream:stream.write(text)
    else: print(text)
    return 0 if not args.gpu or result['gpu']['status']=='PASS' else 2


if __name__=='__main__':
    try: raise SystemExit(main())
    except (ValueError, OSError):
        print(json.dumps({'status':'FAIL','reason':'invalid_inputs_or_numerical_parity'}))
        raise SystemExit(1)
