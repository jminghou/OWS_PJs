import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_UPLOAD_TOKEN;

// GET - List folders (public, but proxied for consistency)
export async function GET() {
  try {
    if (!STRAPI_TOKEN) {
      // No token - return empty folders (folders require auth)
      return NextResponse.json({ data: [] });
    }

    // Try the admin API for folders (Strapi 5)
    const strapiResponse = await fetch(`${STRAPI_URL}/api/upload/folders`, {
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!strapiResponse.ok) {
      // If folders API is not available (404), return empty array
      // This allows the media browser to work without folder support
      if (strapiResponse.status === 404) {
        console.warn('Strapi folders API not available - folder feature disabled');
        return NextResponse.json({ data: [] });
      }

      const error = await strapiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch folders', data: [] },
        { status: strapiResponse.status }
      );
    }

    const result = await strapiResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Folder list error:', error);
    // Check if it's a connection error (Strapi not running)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Strapi Media Hub is not available. Please ensure Strapi is running on ' + STRAPI_URL, data: [] },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', data: [] },
      { status: 500 }
    );
  }
}

// POST - Create folder
export async function POST(request: NextRequest) {
  console.log('[strapi-folders] POST request received');

  try {
    if (!STRAPI_TOKEN) {
      console.log('[strapi-folders] No STRAPI_TOKEN configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log('[strapi-folders] Request body:', body);

    const strapiUrl = `${STRAPI_URL}/api/upload/folders`;
    console.log('[strapi-folders] Calling Strapi:', strapiUrl);

    const strapiResponse = await fetch(strapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    console.log('[strapi-folders] Strapi response status:', strapiResponse.status);

    if (!strapiResponse.ok) {
      const error = await strapiResponse.json().catch(() => ({}));
      console.log('[strapi-folders] Strapi error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'Failed to create folder' },
        { status: strapiResponse.status }
      );
    }

    const result = await strapiResponse.json();
    console.log('[strapi-folders] Created folder:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Folder create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update folder
export async function PUT(request: NextRequest) {
  try {
    if (!STRAPI_TOKEN) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const strapiResponse = await fetch(`${STRAPI_URL}/api/upload/folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    if (!strapiResponse.ok) {
      const error = await strapiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error?.message || 'Failed to update folder' },
        { status: strapiResponse.status }
      );
    }

    const result = await strapiResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Folder update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete folder
export async function DELETE(request: NextRequest) {
  try {
    if (!STRAPI_TOKEN) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      );
    }

    const strapiResponse = await fetch(`${STRAPI_URL}/api/upload/folders/${folderId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
    });

    if (!strapiResponse.ok) {
      const error = await strapiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error?.message || 'Failed to delete folder' },
        { status: strapiResponse.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Folder delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
