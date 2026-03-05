import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { CreatePaymentUseCase } from "../../../application/create-payment.js";

export function buildPaymentRouter(createPaymentUseCase: CreatePaymentUseCase): Router {
  const router = createRouter();

  router.post("/payments", async (req: Request, res: Response) => {
    const payment = await createPaymentUseCase.execute(req.body);
    res.status(201).json(payment);
  });

  return router;
}
