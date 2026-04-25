export interface AddableProduct {
  id: number;
  nameLt: string;
  nameEn: string | null;
}

export async function addProductToList(
  listId: number,
  product: AddableProduct,
  language: "lt" | "en",
): Promise<void> {
  const list = await fetch(`/api/grocery-lists/${listId}`).then((r) => r.json());
  const displayName = language === "en" ? product.nameEn || product.nameLt : product.nameLt;
  const items = [
    ...list.items,
    { itemName: displayName, quantity: 1, unit: null, checked: false },
  ];
  await fetch(`/api/grocery-lists/${listId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}
