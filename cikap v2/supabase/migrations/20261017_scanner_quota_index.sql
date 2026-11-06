-- Accélère le comptage mensuel des scans (quota IA).
create index if not exists document_scans_user_created
  on document_scans (user_id, created_at);
