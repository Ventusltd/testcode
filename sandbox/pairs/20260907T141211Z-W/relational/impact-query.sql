WITH RECURSIVE up(component_id, depth, path) AS (
  SELECT :changed, 0, :changed
  UNION
  SELECT e.consumer_id, up.depth + 1, up.path || ' > ' || e.consumer_id
  FROM dependency_edges e JOIN up ON e.dependency_id = up.component_id
  WHERE up.depth < 12 AND instr(up.path, e.consumer_id) = 0
)
SELECT DISTINCT up.component_id AS affected_component, up.depth, pc.pair_id, tr.run_id, tr.test_id, tr.outcome AS recorded_outcome,
  (SELECT group_concat(evidence_status) FROM dependency_edges d WHERE d.consumer_id = up.component_id) AS edge_evidence
FROM up
LEFT JOIN pair_components pc ON pc.component_id = up.component_id
LEFT JOIN run_inputs ri ON ri.component_id = up.component_id
LEFT JOIN test_runs tr ON tr.run_id = ri.run_id
ORDER BY up.depth, up.component_id
