import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { CreateOrderUseCase } from "../../../application/create-order.js";
import { GetOrderUseCase } from "../../../application/get-order.js";

export function buildOrderRouter(
  createOrderUseCase: CreateOrderUseCase,
  getOrderUseCase: GetOrderUseCase,
): Router {
  const router = createRouter();

  router.post("/orders", async (req: Request, res: Response) => {
    const order = await createOrderUseCase.execute(req.body);
    res.status(201).json(order);
  });

  router.get("/orders/:id", async (req: Request, res: Response) => {
    const order = await getOrderUseCase.execute(req.params.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(order);
  });

  return router;
}
