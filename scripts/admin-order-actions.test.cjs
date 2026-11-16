const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const src = fs.readFileSync('app/admin/orders-details/[id].js', 'utf8');

test("l'administrateur peut confirmer, préparer et annuler une commande depuis sa fiche", () => {
  assert.match(src, /updateOrderStatus\(orderId, next, token\)/);
  assert.match(src, /'En attente': 'Confirmée', Confirmée: 'En préparation'/);
  assert.match(src, /changeStatus\('Annulée'\)/);
});

test("l'annulation demande une confirmation et prévient du remboursement d'une commande payée", () => {
  assert.match(src, /cancelConfirmPaid/);
  assert.match(src, /cancelConfirmUnpaid/);
  assert.match(src, /style: 'destructive'/);
});

test('aucune action sur une commande livrée ou déjà annulée', () => {
  assert.match(src, /\['En attente', 'Confirmée', 'En préparation'\]\.includes\(order\?\.status\)/);
});
