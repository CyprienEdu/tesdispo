import { NextResponse } from 'next/server';

import { sendHelloWorldEmail } from '@/lib/resend';

export async function POST() {
  try {
    const result = await sendHelloWorldEmail();

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
