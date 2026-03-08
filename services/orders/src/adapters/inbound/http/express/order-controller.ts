import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { CreateOrderUseCase } from "../../../../application/create-order.js";
import { GetOrderUseCase } from "../../../../application/get-order.js";
import { CancelOrderUseCase } from "../../../../application/cancel-order.js";
import { DeleteOrderUseCase } from "../../../../application/delete-order.js";

export function buildOrderRouter(
  createOrderUseCase: CreateOrderUseCase,
  getOrderUseCase: GetOrderUseCase,
  cancelOrderUseCase: CancelOrderUseCase,
  deleteOrderUseCase: DeleteOrderUseCase,
): Router {
  const router = createRouter();

  router.post("/order", async (req: Request, res: Response) => {
    const order = await createOrderUseCase.execute(req.body);
    res.status(201).json(order);
  });

  router.get("/order/:id", async (req: Request, res: Response) => {
    const order = await getOrderUseCase.execute(req.params.id);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(order);
  });

  router.put("/order/:id/cancel", async (req: Request, res: Response) => {
    try {
      await cancelOrderUseCase.execute(req.params.id);
      res.status(200).send();
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  })

  router.delete("/order/:id", async (req: Request, res: Response) => {
    try {
      await deleteOrderUseCase.execute(req.params.id);
      res.status(200).send();
    } catch (error) {
      if (error instanceof Error && error.message === "Order not found") {
        res.status(404).json({ error: "Order not found" });
        return;
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
