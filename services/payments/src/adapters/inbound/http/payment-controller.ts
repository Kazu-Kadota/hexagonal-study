import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { CreatePaymentUseCase } from "../../../application/create-payment.js";
import { GetPaymentUseCase } from "../../../application/get-payment.js";

export function buildPaymentRouter(
  createPaymentUseCase: CreatePaymentUseCase,
  getPaymentUseCase: GetPaymentUseCase,
): Router {
  const router = createRouter();

  router.post("/payments", async (req: Request, res: Response) => {
    const payment = await createPaymentUseCase.execute(req.body);
    res.status(201).json(payment);
  });

  router.get("/payments/:paymentId", async (req: Request, res: Response) => {
    const payment = await getPaymentUseCase.execute(req.params.paymentId);
    res.status(200).json(payment);
  });

  return router;
}
