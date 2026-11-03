// Pin each asynchronous draft attempt to the account that started it.
export function createDraftOwnerGuard(getCurrentOwner) {
  const owner = getCurrentOwner();
  if (!owner) throw new Error("Bitte zuerst anmelden.");
  return () => {
    if (getCurrentOwner() !== owner) throw new Error("Das Konto hat gewechselt. Der Entwurf bleibt beim ursprünglichen Konto.");
  };
}
