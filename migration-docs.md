# Migration Documentation: Base64 to Storage-Based Images

## Table of Contents
1. [Edge Function Changes](#1-edge-function-changes)
2. [Database Changes](#2-database-changes)
3. [Storage Setup](#3-storage-setup)
4. [Frontend Changes](#4-frontend-changes)
5. [Required Packages](#5-required-packages)
6. [Testing Checklist](#6-testing-checklist)

## 1. Edge Function Changes

### Old Version (Base64)
```typescript
const imageBuffer = await clipdropResponse.arrayBuffer();
const base64Image = encode(imageBuffer);
const dataUrl = `data:image/png;base64,${base64Image}`;

await supabaseAdmin.from('generated_images').insert({
  user_id: user.id,
  processed_image_data_url: dataUrl,
  status: 'success'
});
```

### New Version (Storage-Based)
```typescript
const imageBuffer = await clipdropResponse.arrayBuffer();
const filePath = `${user.id}/${Date.now()}.png`;

// 1. Upload to Storage
const { error: storageError } = await supabaseAdmin.storage
  .from('processed-images')
  .upload(filePath, new Uint8Array(imageBuffer), { 
    contentType: 'image/png' 
  });

if (storageError) {
  return new Response(JSON.stringify({ error: 'Failed to store image.' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 500
  });
}

// 2. Save path to database
await supabaseAdmin.from('generated_images').insert({
  user_id: user.id,
  processed_image_url: filePath,
  status: 'success'
});

// 3. Get public URL
const { data: { publicUrl } } = supabaseAdmin.storage
  .from('processed-images')
  .getPublicUrl(filePath);

// 4. Return URL instead of base64
return new Response(JSON.stringify({ 
  image: publicUrl,
  success: true 
}));
```

## 2. Database Changes

### SQL Commands
```sql
-- 1. Add new column for storage URLs
ALTER TABLE generated_images 
ADD COLUMN processed_image_url text;

-- 2. Make old base64 column nullable (optional)
ALTER TABLE generated_images 
ALTER COLUMN processed_image_data_url DROP NOT NULL;

-- 3. Enable RLS
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- 4. Add RLS policies for generated_images
CREATE POLICY "Users can delete their own images"
ON generated_images
FOR DELETE
USING (auth.uid() = user_id);

-- 5. Add RLS policies for storage
CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'processed-images' AND (storage.foldername(name))[1] = auth.uid()::text);
```

## 3. Storage Setup

1. Create Storage Bucket:
   - Name: `processed-images`
   - Access: Public (or private with policies)
   - Structure: `processed-images/{user_id}/{timestamp}.png`

2. Storage Policies:
   - Enable users to delete their own files
   - Ensure proper access control
   - Set up folder structure by user ID

## 4. Frontend Changes

### Gallery Component Updates
```typescript
// 1. Update GeneratedImage interface
interface GeneratedImage {
  id: string;
  processed_image_url?: string;    // New field
  processed_image_data_url?: string; // Legacy field
  created_at: string;
}

// 2. Add helper function for public URLs
const getPublicUrl = (filePath: string) => {
  return supabase.storage
    .from('processed-images')
    .getPublicUrl(filePath)
    .data.publicUrl;
};

// 3. Update image display
const renderImageItem = ({ item }: { item: GeneratedImage }) => {
  const imageUrl = item.processed_image_url 
    ? getPublicUrl(item.processed_image_url)
    : item.processed_image_data_url;

  return (
    <Image source={{ uri: imageUrl }} style={styles.thumbnailImage} />
  );
};
```

### Download Function
```typescript
const downloadImage = async () => {
  if (!processedImage) return;
  
  try {
    // Request permission
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed');
      return;
    }

    const filename = FileSystem.documentDirectory + `download_${Date.now()}.png`;

    if (processedImage.startsWith('http')) {
      // Handle storage URL
      const response = await fetch(processedImage);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.readAsDataURL(blob);
      });

      const base64 = await base64Promise;
      await FileSystem.writeAsStringAsync(
        filename,
        base64.split(',')[1],
        { encoding: FileSystem.EncodingType.Base64 }
      );
    } else {
      // Handle base64
      await FileSystem.writeAsStringAsync(
        filename,
        processedImage.split(',')[1],
        { encoding: FileSystem.EncodingType.Base64 }
      );
    }

    // Save to gallery
    const asset = await MediaLibrary.createAssetAsync(filename);
    await MediaLibrary.createAlbumAsync('Remove.Help', asset, false);
    await FileSystem.deleteAsync(filename);

    Alert.alert('Success', 'Image saved to gallery');
  } catch (error) {
    console.error('Download error:', error);
    Alert.alert('Error', 'Failed to save image');
  }
};
```

### Share Function
```typescript
const shareImage = async (imageUrl: string) => {
  try {
    const filename = FileSystem.documentDirectory + `image_${Date.now()}.png`;
    
    if (imageUrl.startsWith('http')) {
      // Handle storage URL
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.readAsDataURL(blob);
      });

      const base64 = await base64Promise;
      await FileSystem.writeAsStringAsync(
        filename,
        base64.split(',')[1],
        { encoding: FileSystem.EncodingType.Base64 }
      );
    } else {
      // Handle base64
      await FileSystem.writeAsStringAsync(
        filename,
        imageUrl.split(',')[1],
        { encoding: FileSystem.EncodingType.Base64 }
      );
    }
    
    await Share.share({
      url: filename,
      title: 'Share Background Removed Image',
      message: 'Check out this background-removed image!'
    });
  } catch (error) {
    console.error('Share error:', error);
    Alert.alert('Error', 'Failed to share image');
  }
};
```

## 5. Required Packages
```bash
# Install required packages
npx expo install expo-media-library
```

## 6. Testing Checklist

- [ ] Edge Function:
  - [ ] Uploads to storage successfully
  - [ ] Creates correct file path
  - [ ] Returns public URL
  - [ ] Handles errors properly

- [ ] Database:
  - [ ] New column exists
  - [ ] RLS policies work
  - [ ] Delete operations work

- [ ] Storage:
  - [ ] Bucket is accessible
  - [ ] Files are organized by user
  - [ ] Delete operations work

- [ ] Frontend:
  - [ ] Gallery displays images correctly
  - [ ] Download works
  - [ ] Share works
  - [ ] Delete works
  - [ ] Permissions work correctly

## Notes
- Keep both `processed_image_url` and `processed_image_data_url` during migration
- Test thoroughly with both new and existing images
- Monitor storage usage and implement cleanup if needed
- Consider implementing image optimization for large files 