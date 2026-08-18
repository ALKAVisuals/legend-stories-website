BEGIN;

GRANT SELECT ON legend_commerce.orders TO __LEGEND_RUNTIME_ROLE__;
GRANT SELECT, INSERT ON legend_commerce.withdrawal_requests TO __LEGEND_RUNTIME_ROLE__;

COMMIT;
