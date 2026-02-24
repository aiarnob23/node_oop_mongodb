import type { PaginationOptions, PaginationResult } from "../types/types";
import { DatabaseError, NotFoundError } from "./errors/AppError";
import { AppLogger } from "./logging/logger";


export interface BaseServiceOptions {
    enableSoftDelete?: boolean;
    enableAuditFields?: boolean;
    defaultPageSize?: number;
    maxPageSize?: number;
}

export abstract class BaseService<TModel = any, TCreateInput = any, TUpdateInput = any> {

    protected prisma: PrismaClient;
    protected modelName: string;
    protected options: BaseServiceOptions;

    constructor(prisma: PrismaClient, modelName: string, options: BaseServiceOptions = {}) {
        this.prisma = prisma;
        this.modelName = modelName;
        this.options = {
            enableSoftDelete: false,
            enableAuditFields: false,
            defaultPageSize: 10,
            maxPageSize: 1000,
            ...options,
        };
    }

    protected abstract getModel(): any;

    //create
    protected async create(data: TCreateInput, include?: any): Promise<TModel> {
        try {
            const createData = this.options.enableAuditFields
                ? { ...data, createdAt: new Date(), updatedAt: new Date() }
                : data

            return await this.getModel().create({ data: createData, include });
        } catch (error) {
            return this.handleDatabaseError(error, 'create');
        }
    }

    //find one
    protected async findOne(filters: any, include?: any): Promise<TModel | null> {
        try {
            return this.getModel().findFirst({ where: filters, include });
        }
        catch (error) {
            return this.handleDatabaseError(error, 'findOne');
        }
    }

    //find by id
    protected async findById(id: string | number, include?: any): Promise<TModel> {
        try {
            return await this.getModel().findFirst({ where: { id }, include });
        } catch (error) {
            return this.handleDatabaseError(error, 'findById');
        }
    }

    //find many
    protected async findMany(
        filters: any = {},
        pagination?: Partial<PaginationOptions>,
        orderBy?: Record<string, 'asc' | 'desc'>,
        include?: any,
        select?: any
    ): Promise<PaginationResult<TModel>> {
        try {
            const where = this.buildWhereClause(filters);
            const finalPagination = this.normalizePagination(pagination);
            orderBy: orderBy || { id: 'desc' };

            const [data, total] = await Promise.all([
                this.getModel().findMany({
                    where,
                    skip: finalPagination.offset,
                    take: finalPagination.limit,
                    orderBy,
                    include,
                    select,
                }),
                this.getModel().count({ where }),
            ]);
            return this.buuildPaginationResult(data, total, finalPagination);
        } catch (error) {
            return this.handleDatabaseError(error, 'findMany');
        }
    }

    /**
    * Check if a record exists
    */
    protected async exists(filters: any): Promise<boolean> {
        try {
            const where = this.buildWhereClause(filters);
            const count = await this.getModel().count({ where });
            return count > 0;
        } catch (error) {
            return this.handleDatabaseError(error, 'exists');
        }
    }

    //update by id
    protected async updateById(
        id: string | number,
        data: TUpdateInput,
        include?: any,
    ): Promise<TModel> {
        try {
            const updateData = this.options.enableAuditFields ?
                { ...data, updatedAt: new Date() }
                : data

            return await this.getModel().update({ where: { id }, data: updateData, include });
        } catch (error) {
            return this.handleDatabaseError(error, 'updateById');
        }
    }

    //-------------handle database error------------------------------------//
    private handleDatabaseError(error: any, operation: string): never {
        AppLogger.error(`Database error in ${this.modelName}.${operation}`, { error });
        if (error.code === 'P2025') throw new NotFoundError(`${this.modelName} not found`);
        throw new DatabaseError(`Database operation failed: ${this.modelName}.${operation}`, { originalError: error.message, code: error.code });
    }

    //-------------------------------pagination--------------------------------//
    //build normalize pagination
    private normalizePagination(pagination?: Partial<PaginationOptions>): PaginationOptions {
        const page = Math.max(1, pagination?.page || 1);
        const limit = Math.min(
            this.options.maxPageSize!,
            Math.max(1, pagination?.limit || this.options.defaultPageSize!)
        );
        const offset = (page - 1) * limit;
        return { page, limit, offset };
    }

    //build pagination result
    private buuildPaginationResult<T>(data: T[], total: number, pagination: PaginationOptions): PaginationResult<T> {
        const totalPages = Math.ceil(total / pagination.limit);
        return { data, total, page: pagination.page, limit: pagination.limit, totalPages, hasNext: pagination.page < totalPages, hasPrevious: pagination.page > 1 };
    }

    //build where clause
    protected buildWhereClause(filters: any): any {
        if (this.options.enableSoftDelete) return { ...filters, deletedAt: null };
        return filters;
    }
}