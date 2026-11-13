SELECT 'CREATE ROLE dms_owner NOLOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dms_owner')
\gexec

GRANT dms_owner TO baohuy, giabao, giahuy, kimanh;

SELECT format('CREATE DATABASE %I OWNER dms_owner', db)
FROM unnest(ARRAY['auth_db', 'account_db', 'category_db', 'department_db', 'organization_db']) AS db
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = db)
\gexec

SELECT format('ALTER ROLE %I IN DATABASE %I SET role = %L', m, db, 'dms_owner')
FROM unnest(ARRAY['baohuy', 'giabao', 'giahuy', 'kimanh']) AS m,
     unnest(ARRAY['auth_db', 'account_db', 'category_db', 'department_db', 'organization_db']) AS db
\gexec

\c auth_db
ALTER SCHEMA public OWNER TO dms_owner;
\c account_db
ALTER SCHEMA public OWNER TO dms_owner;
\c category_db
ALTER SCHEMA public OWNER TO dms_owner;
\c department_db
ALTER SCHEMA public OWNER TO dms_owner;
\c organization_db
ALTER SCHEMA public OWNER TO dms_owner;

\echo 'Xong: 5 database DMS da san sang tren postgres-shared'
