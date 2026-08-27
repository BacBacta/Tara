-- Stock chiffré (V2, drops) : NULL = illimité, 0 = épuisé.
ALTER TABLE products ADD COLUMN stock_qty INTEGER;
