import { Request, Response } from 'express';
import { pool } from '../../config/db.config';

export const getAllRules = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM rules ORDER BY id ASC');
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error('Error fetching rules:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch rules and regulations' });
    }
};

export const createRule = async (req: Request, res: Response) => {
    try {
        const { title, content } = req.body;
        
        if (!content) {
            res.status(400).json({ success: false, message: 'Content is required' });
            return;
        }

        const query = `
            INSERT INTO rules (title, content, updated_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            RETURNING *
        `;
        const values = [title || 'Hackathon Rules & Regulations', content];
        
        const result = await pool.query(query, values);
        
        res.status(201).json({
            success: true,
            message: 'Rules & Regulations created successfully',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('Error creating rules:', error);
        res.status(500).json({ success: false, message: 'Failed to create rules and regulations' });
    }
};

export const updateRule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, content } = req.body;
        
        const query = `
            UPDATE rules
            SET 
                title = COALESCE($1, title),
                content = COALESCE($2, content),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `;
        const values = [title, content, id];
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Rules not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Rules & Regulations updated successfully',
            data: result.rows[0]
        });
    } catch (error: any) {
        console.error('Error updating rules:', error);
        res.status(500).json({ success: false, message: 'Failed to update rules and regulations' });
    }
};

export const deleteRule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM rules WHERE id = $1 RETURNING id', [id]);
        
        if (result.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Rules not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Rules & Regulations cleared successfully'
        });
    } catch (error: any) {
        console.error('Error deleting rules:', error);
        res.status(500).json({ success: false, message: 'Failed to clear rules and regulations' });
    }
};
