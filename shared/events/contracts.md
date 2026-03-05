# Event Contracts

## order.created
```json
{
  "type": "order.created",
  "payload": {
    "orderId": "string",
    "customerId": "string",
    "amount": 1000,
    "currency": "usd"
  }
}
```

## payment.created
```json
{
  "type": "payment.created",
  "payload": {
    "paymentId": "string",
    "orderId": "string",
    "stripePaymentIntentId": "pi_...",
    "status": "requires_payment_method"
  }
}
```
