 docker exec -it visual-tester-postgres-1 psql -U postgres -d images -c "
  DELETE FROM comparisons;
  DELETE FROM baselines;
  DELETE FROM run_approvals;
  DELETE FROM snapshots;
  DELETE FROM run_sources;
  DELETE FROM runs;
  "
