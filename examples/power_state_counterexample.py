"""Illustrative feeder-state counterexample, not operational control logic.

Context: Google Cloud europe-west2-b outage 20 Oct 2026:
https://status.cloud.google.com/incidents/Xs2XTHzAVC9YnafnPyzj

This model is NOT Google's PLC code, a safe generator-start algorithm,
an engineering design, or a complete electrical topology.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class FeederObservation:
    line_side_energised: bool
    breaker_closed: bool
    load_side_energised: bool


def upstream_voltage_only(a: FeederObservation, b: FeederObservation) -> bool:
    """Flawed indicator: voltage visible on either line-side meter."""
    return a.line_side_energised or b.line_side_energised


def continuity_evidence(feeder: FeederObservation) -> bool:
    """Illustrative evidence predicate ONLY; not sufficient for real safety logic."""
    return (
        feeder.line_side_energised
        and feeder.breaker_closed
        and feeder.load_side_energised
    )


def mismatch(a: FeederObservation, b: FeederObservation) -> bool:
    """True if upstream voltage falsely suggests a healthy load source."""
    return upstream_voltage_only(a, b) and not (
        continuity_evidence(a) or continuity_evidence(b)
    )


if __name__ == "__main__":
    a = FeederObservation(False, True, False)   # Failed active feeder
    b = FeederObservation(True, False, False)   # Live line side, open breaker
    assert upstream_voltage_only(a, b)
    assert mismatch(a, b)
    print("PASS: upstream voltage can be true while neither feeder delivers power")
