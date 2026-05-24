-- Fix default user password hashes (V2 had invalid BCrypt strings)
-- These are real BCrypt hashes (cost 10) for: admin123 / user123
-- Generated on backend bootstrap so seed users actually work.

UPDATE users
SET password = '$2b$10$.ejEJHTjGyEQNN7FFyiU8.bDV.MmdX/8orXq6jxAmcYhae35RyxPG'
WHERE username = 'admin';

UPDATE users
SET password = '$2b$10$uH5THt7izv/Aj0EQLaWlXONjfrwWa0nM4dZ5IifHWgHX9y6O5sfyK'
WHERE username = 'user';
