docker exec -it imgcompare-postgres psql -U imgcompare -d imgcompare -c "
  DELETE FROM comparisons;
  DELETE FROM baselines;
  DELETE FROM run_approvals;
  DELETE FROM snapshots;
  DELETE FROM run_sources;
  DELETE FROM runs;
  "
