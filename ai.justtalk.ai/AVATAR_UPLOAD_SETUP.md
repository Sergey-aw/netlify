# Avatar Upload Setup

## Features Added
- Profile picture upload on Profile page
- Camera icon button overlay on avatar
- Upload validation (image type, max 5MB)
- Automatic deletion of old avatar when uploading new one
- Loading state during upload
- Public URL storage in `profile_photo_url` column

## Supabase Storage Configuration Required

### 1. Create Storage Bucket

Go to **Supabase Dashboard → Storage** and create a new bucket:

**Bucket Name:** `avatars`

**Settings:**
- Public bucket: ✅ **Yes** (to serve images without authentication)
- File size limit: 5 MB
- Allowed MIME types: `image/*`

### 2. Set Storage Policies

Add the following policies for the `avatars` bucket:

#### Policy 1: Allow users to upload their own avatars
```sql
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Policy 2: Allow users to update their own avatars
```sql
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Policy 3: Allow users to delete their own avatars
```sql
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

#### Policy 4: Allow public read access
```sql
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

### 3. File Structure

Avatars are stored with the following structure:
```
avatars/
  └── {user_id}/
      └── {timestamp}.{extension}
```

Example: `avatars/550e8400-e29b-41d4-a716-446655440000/1705678123456.jpg`

## Usage

Users can:
1. Click the camera icon on their profile avatar
2. Select an image file (max 5MB)
3. Image is automatically uploaded and displayed
4. Old avatar is automatically deleted

## Technical Details

- **Storage location**: Supabase Storage bucket `avatars`
- **Database column**: `profiles.profile_photo_url` (already exists)
- **File size limit**: 5 MB
- **Supported formats**: All image types (jpeg, png, gif, webp, etc.)
- **Caching**: 1 hour (`cacheControl: '3600'`)
- **Query invalidation**: Automatically refetches profile data after upload

## Error Handling

- File type validation
- File size validation (max 5MB)
- Upload error alerts
- Loading state prevents duplicate uploads
