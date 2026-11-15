"""Prove four adversarial checks reject a deliberately unsafe binding implementation."""
from importlib.util import spec_from_file_location, module_from_spec
import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from src import engine
spec=spec_from_file_location('agent10_test_engine',ROOT/'tests/test_engine.py')
module=module_from_spec(spec)
spec.loader.exec_module(module)
CASES=['test_01_same_title_wrong_repd_rejected','test_04_fuzzy_title_only_weak','test_05_reviewed_url_does_not_fix_wrong_project','test_40_no_unknown_implicit_repd_binding']
def run():
    suite=unittest.TestSuite(module.AdversarialTests(name) for name in CASES)
    output=io.StringIO()
    result=unittest.TextTestRunner(stream=output,verbosity=2).run(suite)
    return result,output.getvalue()
with patch.object(engine,'association',lambda row, receipt:'supported'):
    mutant,mutant_log=run()
clean,clean_log=run()
assert mutant.testsRun==4 and len(mutant.failures)+len(mutant.errors)==4, 'UNSAFE mutant escaped the negative suite'
assert clean.testsRun==4 and clean.wasSuccessful(), 'correct implementation still rejected'
report={'schema':'globalgrid2050.agent10.mutation-probe.v1','mutation':'replace exact REPD association with unconditional supported','unsafe_mutant':{'executed':mutant.testsRun,'failed_as_expected':len(mutant.failures),'errors':len(mutant.errors)},'restored':{'executed':clean.testsRun,'passed':clean.testsRun-len(clean.failures)-len(clean.errors)},'interpretation':'Four unsafe binding mutations produced RED; restoring original implementation produced GREEN. No production code was changed.'}
(ROOT/'results/mutation-probe.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print('MUTATION PROBE:',report['unsafe_mutant']['failed_as_expected'],'red controls,',report['restored']['passed'],'restored PASS')
