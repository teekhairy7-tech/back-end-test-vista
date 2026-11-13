
import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient, Prisma } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Helper: Validate ID
function getId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Helper: Handle Prisma errors
function handleError(res: express.Response, error: unknown) {
  console.error(error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({
        status: "error",
        message: "Record already exists",
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        status: "error",
        message: "Record not found",
      });
    }

    if (error.code === "P2003") {
      return res.status(400).json({
        status: "error",
        message: "Invalid company ID",
      });
    }
  }

  return res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
}

// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "Vista Backend API is running",
    status: "success",
  });
});

// Health check
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "success",
      message: "API and database are connected",
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =====================================
// COMPANY API
// =====================================

// GET all companies
app.get("/companies", async (_req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: { services: true },
    });

    res.json({
      status: "success",
      data: companies,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// GET company by ID
app.get("/companies/:id", async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Invalid company ID",
      });
    }

    const company = await prisma.company.findUnique({
      where: { id },
      include: { services: true },
    });

    if (!company) {
      return res.status(404).json({
        status: "error",
        message: "Company not found",
      });
    }

    res.json({ status: "success", data: company });
  } catch (error) {
    handleError(res, error);
  }
});

// CREATE company
app.post("/companies", async (req, res) => {
  try {
    const { name, registrationNumber } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof registrationNumber !== "string" ||
      !registrationNumber.trim()
    ) {
      return res.status(400).json({
        status: "error",
        message: "Name and registrationNumber are required",
      });
    }

    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        registrationNumber: registrationNumber.trim(),
      },
    });

    res.status(201).json({
      status: "success",
      data: company,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// UPDATE company
app.put("/companies/:id", async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Invalid company ID",
      });
    }

    const { name, registrationNumber } = req.body;

    if (name === undefined && registrationNumber === undefined) {
      return res.status(400).json({
        status: "error",
        message: "At least one field is required",
      });
    }

    const data: {
      name?: string;
      registrationNumber?: string;
    } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Invalid company name",
        });
      }
      data.name = name.trim();
    }

    if (registrationNumber !== undefined) {
      if (
        typeof registrationNumber !== "string" ||
        !registrationNumber.trim()
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid registration number",
        });
      }
      data.registrationNumber = registrationNumber.trim();
    }

    const company = await prisma.company.update({
      where: { id },
      data,
    });

    res.json({ status: "success", data: company });
  } catch (error) {
    handleError(res, error);
  }
});

// DELETE company
app.delete("/companies/:id", async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Invalid company ID",
      });
    }

    await prisma.company.delete({ where: { id } });

    res.json({
      status: "success",
      message: "Company deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
});

// =====================================
// SERVICE API
// =====================================

// GET all services
app.get("/services", async (_req, res) => {
  try {
    const services = await prisma.service.findMany({
      include: { company: true },
    });

    res.json({
      status: "success",
      data: services,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// GET service by ID
app.get("/services/:id", async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Invalid service ID",
      });
    }

    const service = await prisma.service.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!service) {
      return res.status(404).json({
        status: "error",
        message: "Service not found",
      });
    }

    res.json({ status: "success", data: service });
  } catch (error) {
    handleError(res, error);
  }
});

// CREATE service
app.post("/services", async (req, res) => {
  try {
    const { companyId, name, description, price } = req.body;

    const parsedCompanyId = Number(companyId);
    const parsedPrice = Number(price);

    if (
      !Number.isInteger(parsedCompanyId) ||
      parsedCompanyId <= 0 ||
      typeof name !== "string" ||
      !name.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      price === undefined ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      return res.status(400).json({
        status: "error",
        message: "Valid companyId, name, description and price are required",
      });
    }

    const service = await prisma.service.create({
      data: {
        companyId: parsedCompanyId,
        name: name.trim(),
        description: description.trim(),
        price: new Prisma.Decimal(parsedPrice),
      },
      include: { company: true },
    });

    res.status(201).json({
      status: "success",
      data: service,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// UPDATE service
app.put("/services/:id", async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Invalid service ID",
      });
    }

    const { companyId, name, description, price } = req.body;

    if (
      companyId === undefined &&
      name === undefined &&
      description === undefined &&
      price === undefined
    ) {
      return res.status(400).json({
        status: "error",
        message: "At least one field is required",
      });
    }

    const data: {
      companyId?: number;
      name?: string;
      description?: string;
      price?: Prisma.Decimal;
    } = {};

    if (companyId !== undefined) {
      const parsedCompanyId = Number(companyId);

      if (!Number.isInteger(parsedCompanyId) || parsedCompanyId <= 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid company ID",
        });
      }

      data.companyId = parsedCompanyId;
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Invalid service name",
        });
      }
      data.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string" || !description.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Invalid description",
        });
      }
      data.description = description.trim();
    }

    if (price !== undefined) {
      const parsedPrice = Number(price);

      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid price",
        });
      }

      data.price = new Prisma.Decimal(parsedPrice);
    }

    const service = await prisma.service.update({
      where: { id },
      data,
      include: { company: true },
    });

    res.json({ status: "success", data: service });
  } catch (error) {
    handleError(res, error);
  }
});

// DELETE service
app.delete("/services/:id", async (req, res) => {
  try {
    const id = getId(req.params.id);

    if (!id) {
      return res.status(400).json({
        status: "error",
        message: "Invalid service ID",
      });
    }

    await prisma.service.delete({ where: { id } });

    res.json({
      status: "success",
      message: "Service deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
});

// Start server
async function startServer() {
  try {
    await prisma.$connect();

    app.listen(PORT, () => {
      console.log(`Vista Backend API running at http://localhost:${PORT}`);
      console.log("Database connected successfully");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
