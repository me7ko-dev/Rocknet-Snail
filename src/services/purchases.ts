// Placeholder for real-money purchases. Right now nothing can be bought.
// Later: plug in expo-iap or RevenueCat (needs a development build) here.

export type Product = {
  id: string; // e.g. 'lettuce_pack_small'
  title: string;
  price: string; // formatted by the store, e.g. "0,99 €"
};

export const purchases = {
  async init(): Promise<void> {},

  async getProducts(): Promise<Product[]> {
    return [];
  },

  /** Returns true if the purchase went through. */
  async buy(_productId: string): Promise<boolean> {
    return false;
  },
};
