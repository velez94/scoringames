# Event Image Upload Feature

## Overview
Added event banner image upload functionality with S3 storage and display across athlete and backoffice views.

## Implementation Details

### Backend Changes

#### S3 Bucket
- **Bucket Name**: `calisthenics-event-images-571340586587`
- **Purpose**: Store event banner images
- **Configuration**:
  - Public read access enabled
  - CORS configured for PUT/POST/GET
  - Auto-delete on stack removal

#### Lambda Function Updates
- **New Endpoint**: `POST /events/{eventId}/upload-image`
- **Function**: `uploadEventImage(eventId, data)`
- **Process**:
  1. Receives base64 image data
  2. Converts to buffer
  3. Uploads to S3 with key: `events/{eventId}/{timestamp}-{fileName}`
  4. Updates event record with `bannerImage` URL
  5. Returns public S3 URL

#### API Gateway
- Added authenticated POST route: `/events/{eventId}/upload-image`
- Requires Cognito authorization

### Frontend Changes

#### EventDetails Component (Backoffice)
- **Edit Button**: Added to page header for quick access
- **Banner Display**: Shows event banner image if available
- **Upload Interface**: File input button for image upload
- **Features**:
  - Real-time upload with loading state
  - Automatic refresh after upload
  - Base64 encoding for API transmission

#### Events Component (Athlete View)
- **Banner Display**: Shows banner images in event cards
- **Card Layout**: 
  - Banner image at top (150px height)
  - Event content below
  - Responsive design

#### EventManagement Component
- **Edit Integration**: Passes `onEdit` handler to EventDetails
- **Workflow**: View event → Edit button → Opens edit modal

## User Experience

### Backoffice Flow
1. Navigate to Event Management
2. Click event to view details
3. Click "Edit Event" button OR
4. Click "Upload Banner Image" button
5. Select image file
6. Image uploads and displays immediately

### Athlete Flow
1. View Events page
2. See banner images on event cards
3. Visual appeal and event branding

## Technical Specifications

### Image Upload
- **Format**: Base64 encoded
- **Supported Types**: All image formats (image/*)
- **Storage Path**: `events/{eventId}/{timestamp}-{filename}`
- **URL Format**: `https://calisthenics-event-images-{accountId}.s3.amazonaws.com/{key}`

### Security
- Upload endpoint requires Cognito authentication
- Only authenticated users can upload
- Public read access for display

### Performance
- Images stored in S3 for fast delivery
- CloudFront can be added for CDN distribution
- Lazy loading on event cards

## Cost Optimization
- S3 Standard storage class
- Pay-per-request pricing
- Auto-delete on stack removal prevents orphaned data

## Future Enhancements
- Image compression before upload
- Multiple image support (gallery)
- Image cropping/editing interface
- CloudFront CDN for image delivery
- Thumbnail generation for faster loading
- Image validation (size, format, dimensions)

## Deployment
- **Profile**: labvel-dev
- **Stack**: CalisthenicsAppStack
- **Bucket**: calisthenics-event-images-571340586587
- **Status**: ✅ Deployed and operational
