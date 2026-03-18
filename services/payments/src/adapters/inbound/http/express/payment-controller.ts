import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { CreatePaymentUseCase } from "../../../../application/create-payment.js";
import { GetPaymentUseCase } from "../../../../application/get-payment.js";
import { IHTTPSPort } from "../../../../application/ports/inbound/http.js";
import { CreatePaymentBody, CreatePaymentOutput } from "./dtos/create-payment.js";
import { GetPaymentOutput, GetPaymentParams } from "./dtos/get-payment.js";

export class PaymentController implements IHTTPSPort {
  constructor(
    private readonly createPaymentUseCase: CreatePaymentUseCase,
    private readonly getPaymentUseCase: GetPaymentUseCase,
  ) {}
  
  async createPayment(body: CreatePaymentBody): Promise<CreatePaymentOutput> {
    return await this.createPaymentUseCase.execute(body)
  }
  
  async getPayment(params: GetPaymentParams): Promise<GetPaymentOutput> {
    return await this.getPaymentUseCase.execute(params.id)
  }
  
  buildRouter(): Router {
    const router = createRouter();

    router.post("/payments", async (req: Request, res: Response) => {
      const payment = await this.createPayment(req.body);
      res.status(201).json(payment);
    });

    router.get("/payments/:id", async (req: Request, res: Response) => {
      try {
        const payment = await this.getPayment(req.params as GetPaymentParams);
        res.status(200).json(payment);
      } catch (error) {
        if (error instanceof Error && error.message === "Payment not found") {
          res.status(404).json({ error: "Payment not found" });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    });

    return router;
  }
}
