import { NextRequest, NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_INTERNAL_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_UPLOAD_TOKEN;

export async function POST(request: NextRequest) {
  try {
    // Check for API token
    if (!STRAPI_TOKEN) {
      console.error('STRAPI_UPLOAD_TOKEN is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Get the form data from the request
    const formData = await request.formData();

    // Forward the request to Strapi
    const strapiResponse = await fetch(`${STRAPI_URL}/api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      body: formData,
    });

    if (!strapiResponse.ok) {
      const error = await strapiResponse.json().catch(() => ({ error: { message: 'Upload failed' } }));
      console.error('Strapi upload error:', error);
      return NextResponse.json(
        { error: error.error?.message || 'Upload failed' },
        { status: strapiResponse.status }
      );
    }

    const result = await strapiResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Update file info (alt text, caption)
// Strapi 5: POST /api/upload?id=X with fileInfo in FormData
export async function PUT(request: NextRequest) {
  try {
    if (!STRAPI_TOKEN) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log('[strapi-upload] PUT request for fileId:', fileId, 'body:', body);

    const formData = new FormData();
    formData.append('fileInfo', JSON.stringify(body));

    // Strapi 5 uses POST /api/upload?id=X to update file info
    const strapiUrl = `${STRAPI_URL}/api/upload?id=${fileId}`;
    console.log('[strapi-upload] Calling Strapi:', strapiUrl);

    const strapiResponse = await fetch(strapiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
      body: formData,
    });

    console.log('[strapi-upload] Strapi response status:', strapiResponse.status);

    if (!strapiResponse.ok) {
      const errorText = await strapiResponse.text();
      console.error('[strapi-upload] Strapi error response:', errorText);
      let errorMessage = 'Update failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {}
      return NextResponse.json(
        { error: errorMessage },
        { status: strapiResponse.status }
      );
    }

    const result = await strapiResponse.json();
    console.log('[strapi-upload] Update successful');
    return NextResponse.json(result);
  } catch (error) {
    console.error('Update proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!STRAPI_TOKEN) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    const strapiResponse = await fetch(`${STRAPI_URL}/api/upload/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${STRAPI_TOKEN}`,
      },
    });

    if (!strapiResponse.ok) {
      const error = await strapiResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.error?.message || 'Delete failed' },
        { status: strapiResponse.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
