export type Product = {
    rowVersion: number;
    id: number;
    sku: string;
    name: string;
    category: string;
    unit: string;
    location: string;
    quantity: number;
    minimum: number;
};
export type StockTransaction = {
    id: string;
    productId: number;
    productName: string;
    type: string;
    quantity: number;
    reference: string;
    note: string;
    createdDate: string;
};
