-- Comptes comptables sur les opérations bancaires (rapprochement)
alter table operations_bancaires add column if not exists compte_num text;
alter table operations_bancaires add column if not exists compte_lib text;

create index if not exists ops_bancaires_compte_num_idx on operations_bancaires (compte_num);
