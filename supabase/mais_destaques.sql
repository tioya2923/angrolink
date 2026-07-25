-- ========================================
-- Aumentar produtos em destaque (modelo de sites de venda)
-- Corre no SQL Editor do Supabase.
-- ========================================

update produtos
set destaque = true
where id in (
  '9bee1f99-37e8-4612-b3ba-1f536ed3a902',
  'a0077ed6-37da-4fb1-b6c0-bd9645fd3bf3',
  '2bbb8441-780c-40c2-b46d-0b038b69e648',
  'b61fe567-712e-428d-80f6-36630d8e012e',
  '648bc829-2877-4225-842a-bd2d9dc6a5d4',
  '230f84ef-dab9-426f-9c3c-fac86a818074',
  'dfa74b08-1099-42f2-ae34-f9150d09bd3e',
  '10524155-9f68-4783-8b4b-6476fb090a01',
  '8553fe0d-fbfc-4237-a9c3-f484f4d031ee',
  '2472e991-ccf4-4bfc-bd62-a217c2f25663',
  '6c2ef3a9-f747-44ec-a229-03251b6840de',
  'bcf24097-2803-4fed-888d-2561c146e79d',
  '3723dd75-4f56-4492-8856-e20b1edd8958',
  '599e5d91-879c-4221-ad62-008ca8749ceb'
);
