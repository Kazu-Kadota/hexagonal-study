import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { CreateOrderUseCase } from "../../../../application/create-order.js";
import { GetOrderUseCase } from "../../../../application/get-order.js";
import { CancelOrderUseCase } from "../../../../application/cancel-order.js";
import { DeleteOrderUseCase } from "../../../../application/delete-order.js";
import { IHTTPSPort } from "../../../../application/ports/inbound/http.js";
import { CreateOrderBody } from "./dtos/create-order.js";
import { CreateOrderOutput } from "./dtos/create-order.js";
import { GetOrderOutput, GetOrderParams } from "./dtos/get-order.js";
import { DeleteOrderParams } from "./dtos/delete-order.js";
import { CancelOrderParams } from "./dtos/cancel-order.js";

export class OrderController implements IHTTPSPort {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly deleteOrderUseCase: DeleteOrderUseCase,
  ) {}
  
  async createOrder(body: CreateOrderBody): Promise<CreateOrderOutput> {
    return await this.createOrderUseCase.execute(body)
  }
  
  async getOrder(params: GetOrderParams): Promise<GetOrderOutput> {
    return await this.getOrderUseCase.execute(params.id)
  }
  
  async deleteOrder(params: DeleteOrderParams): Promise<void> {
    await this.deleteOrderUseCase.execute(params.id)
  }
  
  async cancelOrder(params: CancelOrderParams): Promise<void> {
    await this.cancelOrderUseCase.execute(params.id)
  }
  
  buildRouter(): Router {
    const router = createRouter();

    router.post("/order", async (req: Request, res: Response) => {
      try {
        const order = await this.createOrder(req.body);
        res.status(201).json(order);
      } catch (error) {
        res.status(500).json({ error: "Internal server error" });
      }
    });

    router.get("/order/:id", async (req: Request, res: Response) => {
      try {
        const order = await this.getOrder(req.params as GetOrderParams);
        res.status(200).json(order);
      } catch (error) {
        if (error instanceof Error && error.message === "Order not found") {
          res.status(404).json({ error: "Order not found" });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    });

    router.delete("/order/:id", async (req: Request, res: Response) => {
      try {
        await this.deleteOrder(req.params as DeleteOrderParams);
        res.status(204).send();
      } catch (error) {
        if (error instanceof Error && error.message === "Order not found") {
          res.status(404).json({ error: "Order not found" });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    });

    router.put("/order/:id/cancel", async (req: Request, res: Response) => {
      try {
        await this.cancelOrder(req.params as CancelOrderParams);
        res.status(200).send();
      } catch (error) {
        if (error instanceof Error && error.message === "Order not found") {
          res.status(404).json({ error: "Order not found" });
          return;
        }
        res.status(500).json({ error: "Internal server error" });
      }
    })

    return router;
  }
}
