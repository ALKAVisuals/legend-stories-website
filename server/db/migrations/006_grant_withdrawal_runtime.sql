BEGIN;

GRANT SELECT ON legend_commerce.orders TO CURRENT_USER;
GRANT SELECT, INSERT ON legend_commerce.withdrawal_requests TO CURRENT_USER;

COMMIT;
