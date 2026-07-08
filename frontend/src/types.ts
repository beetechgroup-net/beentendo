export interface PriceRecord {
  id: number;
  regularPrice: number;
  salePrice: number | null;
  currency: string;
  recordedAt: string;
}

export interface Game {
  id: number;
  nsuid: string | null;
  name: string;
  platform: string;
  coverImage: string | null;
  prices: PriceRecord[];
}
