const normalized = (value) => String(value || '').trim().toLowerCase();
const digits = (value) => String(value || '').replace(/\D/g, '');

const orderBelongsToProfile = (order, profile) => {
  const owner = normalized(profile?.username);
  const explicitOwners = [order?.username, order?.payerUsername, order?.beneficiaryUsername]
    .map(normalized)
    .filter(Boolean);
  if (explicitOwners.length) return explicitOwners.includes(owner);
  if (order?.userId != null && profile?.id != null) return String(order.userId) === String(profile.id);

  const profileDocument = digits(profile?.cpf);
  const profileAccount = String(profile?.accountNumber || '');
  const profileEmail = normalized(profile?.email);
  return Boolean(
    (profileDocument && digits(order?.beneficiaryDocument) === profileDocument)
    || (profileAccount && String(order?.accountNumber || '') === profileAccount)
    || (profileEmail && normalized(order?.pixKey) === profileEmail)
  );
};

export function sanitizeAccountSnapshot(snapshot, currentUser) {
  const expectedOwner = normalized(currentUser?.username);
  const responseOwner = normalized(snapshot?.profile?.username);
  if (!expectedOwner || !responseOwner) throw new Error('ACCOUNT_DATA_OWNER_MISSING');
  if (expectedOwner !== responseOwner) throw new Error('ACCOUNT_DATA_OWNERSHIP_MISMATCH');
  if (snapshot?.me?.username && normalized(snapshot.me.username) !== expectedOwner) {
    throw new Error('ACCOUNT_DATA_OWNERSHIP_MISMATCH');
  }

  return {
    ...snapshot,
    transactions: (Array.isArray(snapshot.transactions) ? snapshot.transactions : [])
      .filter((item) => !item?.username || normalized(item.username) === expectedOwner),
    externalOrders: (Array.isArray(snapshot.externalOrders) ? snapshot.externalOrders : [])
      .filter((item) => orderBelongsToProfile(item, snapshot.profile)),
  };
}
