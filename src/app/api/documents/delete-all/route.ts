import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function DELETE() {
  try {
    // Delete all documents (cascading will delete chunks)
    await db.document.deleteMany();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete all documents error:', error);
    return NextResponse.json({ error: 'Failed to delete all documents' }, { status: 500 });
  }
}
