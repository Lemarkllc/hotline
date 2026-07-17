import type { Request, Response } from "express";
import type { Channel } from "@hotline/shared";
import { BaseController } from "@/controllers/BaseController.js";
import { reportService } from "@/services/reportService.js";

export class ReportController extends BaseController {
  async summary(req: Request, res: Response): Promise<void> {
    try {
      const { channel, from, to } = req.query as unknown as { channel: Channel; from: Date; to: Date };
      const result = await reportService.summary(req.user!, channel, from, to);
      this.handleSuccess(res, result);
    } catch (error) {
      this.handleError(error, res, "summary");
    }
  }

  async export(req: Request, res: Response): Promise<void> {
    try {
      const { channel, from, to, format, includeAuthor } = req.query as unknown as {
        channel: Channel;
        from: Date;
        to: Date;
        format: "csv" | "xlsx";
        includeAuthor: boolean;
      };
      const { buffer, contentType, filename } = await reportService.exportAppeals(
        req.user!,
        channel,
        from,
        to,
        format,
        includeAuthor,
      );
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      this.handleError(error, res, "export");
    }
  }
}

export const reportController = new ReportController();
