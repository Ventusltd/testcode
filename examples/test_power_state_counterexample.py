"""Offline tests of a *conceptual* false-positive, not a PLC acceptance test.

Run: python -m unittest discover -s examples -p 'test_power_state_counterexample.py' -v
No network, dependencies, switchgear interfaces, or generators are accessed.
"""

import unittest

from power_state_counterexample import (
    FeederObservation,
    continuity_evidence,
    mismatch,
    upstream_voltage_only,
)


class SourceStateCounterexampleTests(unittest.TestCase):
    def test_external_fault_while_other_feeder_is_locked_open(self):
        active_a = FeederObservation(False, True, False)
        disconnected_b = FeederObservation(True, False, False)
        self.assertTrue(upstream_voltage_only(active_a, disconnected_b))
        self.assertFalse(continuity_evidence(active_a))
        self.assertFalse(continuity_evidence(disconnected_b))
        self.assertTrue(mismatch(active_a, disconnected_b))

    def test_available_healthy_a_cannot_be_falsely_called_unavailable(self):
        healthy_a = FeederObservation(True, True, True)
        isolated_b = FeederObservation(True, False, False)
        self.assertTrue(upstream_voltage_only(healthy_a, isolated_b))
        self.assertTrue(continuity_evidence(healthy_a))
        self.assertFalse(mismatch(healthy_a, isolated_b))

    def test_no_upstream_voltage_has_no_specific_mismatch(self):
        dead_a = FeederObservation(False, True, False)
        dead_b = FeederObservation(False, False, False)
        self.assertFalse(upstream_voltage_only(dead_a, dead_b))
        self.assertFalse(mismatch(dead_a, dead_b))

    def test_open_breaker_blocks_simple_continuity_inference(self):
        isolated = FeederObservation(True, False, False)
        self.assertFalse(continuity_evidence(isolated))

    def test_a_single_counterexample_invalidates_upstream_only_sufficiency(self):
        # Counterexample to: "voltage upstream implies usable power at load".
        a = FeederObservation(False, True, False)
        b = FeederObservation(True, False, False)
        self.assertTrue(upstream_voltage_only(a, b))
        self.assertFalse(
            continuity_evidence(a) or continuity_evidence(b)
        )


if __name__ == "__main__":
    unittest.main()
