import unittest
import numpy as np
from probe import inputs, scalar_nearest, subtract_first, verify, fixtures, corpus, bad_float32_dot, run


class DistanceTests(unittest.TestCase):
    def test_offset_norm_matches_independent_scalar(self):
        _,q,p=fixtures()[0]
        expected=scalar_nearest(q,p)
        self.assertEqual(expected[0].tolist(),[1])
        self.assertAlmostEqual(expected[1][0],.03125)
        verify(subtract_first(np,q,p),expected)

    def test_centimetres_do_not_survive_float32_roundtrip(self):
        _,q,p=fixtures()[1]
        expected=scalar_nearest(q,p)
        self.assertEqual(expected[0].tolist(),[1])
        with self.assertRaises(ValueError):verify(bad_float32_dot(np,q,p),expected)
        with self.assertRaises(ValueError):verify(subtract_first(np,q.astype('f4').astype('f8'),p.astype('f4').astype('f8')),expected)

    def test_first_index_wins_exact_tie(self):
        _,q,p=fixtures()[3]
        self.assertEqual(subtract_first(np,q,p)[0].tolist(),[0])
        verify(subtract_first(np,q,p),scalar_nearest(q,p))

    def test_near_tie_is_not_rounded_to_first_candidate(self):
        _,q,p=fixtures()[4]
        expected=scalar_nearest(q,p)
        self.assertEqual(expected[0].tolist(),[1])
        verify(subtract_first(np,q,p),expected)

    def test_negative_cancellation_has_positive_true_distance(self):
        _,q,p=fixtures()[2]
        self.assertEqual(scalar_nearest(q,p)[1].tolist(),[1.])
        verify(subtract_first(np,q,p),scalar_nearest(q,p))

    def test_nonfinite_and_float32_rejected(self):
        q,p=corpus(2,3)
        for value in (np.nan,np.inf,-np.inf):
            bad=q.copy();bad[0,0]=value
            with self.assertRaises(ValueError):inputs(bad,p)
        with self.assertRaises(ValueError):inputs(q.astype('f4'),p)

    def test_empty_oversized_and_bad_dimensions_rejected(self):
        _,p=corpus(2,3)
        for q in (np.zeros((0,2)),np.zeros((513,2)),np.zeros((1,3))):
            with self.assertRaises(ValueError):inputs(q,p)
        with self.assertRaises(ValueError):inputs(p,np.zeros((1025,2)))

    def test_planted_wrong_identity_rejected(self):
        q,p=corpus(8,16);expected=scalar_nearest(q,p)
        indexes=expected[0].copy();indexes[0]=(indexes[0]+1)%len(p)
        with self.assertRaises(ValueError):verify((indexes,expected[1]),expected)

    def test_planted_distance_and_nonfinite_rejected(self):
        q,p=corpus(8,16);expected=scalar_nearest(q,p)
        for value in (-1.,np.nan,np.inf,expected[1][0]+1.):
            distances=expected[1].copy();distances[0]=value
            with self.assertRaises(ValueError):verify((expected[0],distances),expected)

    def test_seeded_fixture_reproducible(self):
        a,b=corpus();c,d=corpus()
        self.assertTrue(np.array_equal(a,c));self.assertTrue(np.array_equal(b,d))

    def test_cpu_receipt_does_not_claim_gpu_pass(self):
        result=run(8,16)
        self.assertEqual(result['gpu']['status'],'NOT_REQUESTED')
        self.assertEqual(result['distinct_pairs'],128)
        self.assertEqual(result['cpu']['parity'],'PASS')
        self.assertEqual(len(result['fixtures']),5)

    def test_broadcast_distance_cannot_pass_receipt(self):
        q,p=corpus(8,16);expected=scalar_nearest(q,p)
        with self.assertRaises(ValueError):verify((expected[0],expected[1][:1]),expected)


if __name__=='__main__':unittest.main()
