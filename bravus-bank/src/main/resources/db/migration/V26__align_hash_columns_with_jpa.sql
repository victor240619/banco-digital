-- PostgreSQL reports CHAR as bpchar while the JPA mappings require VARCHAR.
-- Hash values are preserved; btrim only removes fixed-width padding introduced by CHAR.
ALTER TABLE account_opening_kyc
    ALTER COLUMN front_sha256 TYPE VARCHAR(64) USING btrim(front_sha256)::VARCHAR(64),
    ALTER COLUMN back_sha256 TYPE VARCHAR(64) USING btrim(back_sha256)::VARCHAR(64),
    ALTER COLUMN face_sha256 TYPE VARCHAR(64) USING btrim(face_sha256)::VARCHAR(64);

ALTER TABLE password_reset_requests
    ALTER COLUMN identifier_hash TYPE VARCHAR(64) USING btrim(identifier_hash)::VARCHAR(64),
    ALTER COLUMN client_secret_hash TYPE VARCHAR(64) USING btrim(client_secret_hash)::VARCHAR(64),
    ALTER COLUMN submitted_face_sha256 TYPE VARCHAR(64) USING btrim(submitted_face_sha256)::VARCHAR(64);
