-- ============================================================
-- V7 — Adiciona admin principal: admin_bravus
--
-- Credenciais:
--   username: admin_bravus
--   senha:    6run0955  (hash BCrypt cost=10, validado)
--   role:     ROLE_ADMIN
--
-- Idempotente: pode rodar várias vezes sem efeito colateral.
-- ============================================================

-- Garante role ROLE_ADMIN
INSERT INTO roles (name, description)
SELECT 'ROLE_ADMIN', 'Administrador do sistema'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'ROLE_ADMIN');

-- Cria o admin principal (account_number = 0000000003 — segue padrão de 10 dígitos)
INSERT INTO users (username, password, email, full_name, account_number, account_type, is_active)
SELECT 'admin_bravus',
       '$2b$10$AlsxN3VGMsMOwbXR4V.C0evIhG8eXycBMmLXOqDrmwKUFa.n818ei',
       'admin_bravus@bravusbank.com',
       'Administrador Bravus',
       '0000000003',
       'CORRENTE',
       TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin_bravus');

-- Vincula ROLE_ADMIN
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
  FROM users u, roles r
 WHERE u.username = 'admin_bravus'
   AND r.name = 'ROLE_ADMIN'
   AND NOT EXISTS (
     SELECT 1 FROM user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
   );
