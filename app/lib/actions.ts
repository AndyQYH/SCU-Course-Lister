'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';


//schema for invoice --- omits date and id on form submission which will be provided later
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(
        {
            invalid_type_error: 'Please select a customer.',
        }
    ),
    amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'],{
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
  });

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, return errors early. Otherwise, continue.
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }
    // Test it out:
     // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;
    //store money value in cents to prevent floating point errors
    const amountInCents = amount * 100;
    //get the current date
    const date = new Date().toISOString().split('T')[0];
    //query the new invoice object and update the data base
    try{
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }
    

    //flush the client cache and revalidate new data
    revalidatePath('/dashboard/invoices');
    //redirect to the invoices page to see changes
    redirect('/dashboard/invoices');
}

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    const amountInCents = amount * 100;
   
    try{
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `;
    } catch (err) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }
    
   
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');

    try{
        await sql`DELETE FROM invoices WHERE id = ${id}`;
    }catch (err) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }
    
    revalidatePath('/dashboard/invoices');
}