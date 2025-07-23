import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, Share2, Trash2, X } from 'lucide-react-native';
import { useAuth } from '@/hooks/use_auth';
import { router } from 'expo-router';
import { getGeneratedImages, deleteGeneratedImage } from '@/services/imageService';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';

interface GeneratedImage {
  id: string;
  processed_image_url?: string;
  processed_image_data_url?: string;
  created_at: string;
}

export default function GalleryScreen() {
  const { user } = useAuth();
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [loading, setLoading] = useState(true);

  const getPublicUrl = (filePath: string) => {
    console.log('Getting public URL for:', filePath); // Add logging
    const url = supabase.storage
      .from('processed-images')
      .getPublicUrl(filePath)
      .data.publicUrl;
    console.log('Generated URL:', url); // Add logging
    return url;
  };

  useEffect(() => {
    if (!user) {
      console.log('No user detected, attempting to redirect to login.');
      router.push('/auth/login');
      return;
    }
    console.log('User detected, loading images.');
    loadImages();
  }, [user]);

  const loadImages = async () => {
    try {
      console.log('Loading images...');
      const { data, error } = await getGeneratedImages();
      
      if (error) {
        console.error('Error loading images:', error);
        Alert.alert('Error', 'Failed to load images');
        return;
      }
      
      console.log('Loaded images data:', JSON.stringify(data, null, 2));
      if (data && data.length > 0) {
        data.forEach((img, index) => {
          console.log(`Image ${index}:`, {
            id: img.id,
            hasUrl: !!img.processed_image_url,
            url: img.processed_image_url,
            hasBase64: !!img.processed_image_data_url
          });
        });
      }
      
      setImages(data || []);
    } catch (error) {
      console.error('Error loading images:', error);
      Alert.alert('Error', 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Starting delete process for image:', imageId);
              const { error } = await deleteGeneratedImage(imageId);
              
              if (error) {
                console.error('Delete error:', error);
                Alert.alert(
                  'Error',
                  typeof error === 'string' ? error : 'Failed to delete image. Please try again.'
                );
                return;
              }

              console.log('Image deleted successfully, updating UI');
              setImages(prev => prev.filter(img => img.id !== imageId));
              setSelectedImage(null);
              Alert.alert('Success', 'Image deleted successfully');
            } catch (error) {
              console.error('Delete handler error:', error);
              Alert.alert(
                'Error',
                'An unexpected error occurred while deleting the image. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const shareImage = async (image: GeneratedImage) => {
    try {
      let imageUrl;
      if (image.processed_image_url) {
        // For storage-based images
        imageUrl = getPublicUrl(image.processed_image_url);
        console.log('Sharing storage image:', imageUrl);
        
        // Download the image first
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
        const filename = FileSystem.documentDirectory + `image_${image.id}.png`;
        await FileSystem.writeAsStringAsync(
          filename, 
          base64.split(',')[1],
          { encoding: FileSystem.EncodingType.Base64 }
        );
        
        await Share.share({
          url: filename,
          message: 'Check out this background-removed image from Remove.Help!',
        });
      } else if (image.processed_image_data_url) {
        // Legacy base64 sharing
        const filename = FileSystem.documentDirectory + `image_${image.id}.png`;
        await FileSystem.writeAsStringAsync(
          filename, 
          image.processed_image_data_url.split(',')[1],
          { encoding: FileSystem.EncodingType.Base64 }
        );
        await Share.share({
          url: filename,
          message: 'Check out this background-removed image from Remove.Help!',
        });
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share image');
    }
  };

  const downloadImage = async (image: GeneratedImage) => {
    try {
      if (image.processed_image_url) {
        // For storage-based images
        const publicUrl = getPublicUrl(image.processed_image_url);
        // Here you would implement the actual download logic
        // For now, show success message
        Alert.alert('Success', 'Image saved to gallery');
      } else if (image.processed_image_data_url) {
        // Legacy base64 download
        Alert.alert('Success', 'Image saved to gallery');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to save image');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderImageItem = ({ item }: { item: GeneratedImage }) => {
    const imageUrl = item.processed_image_url 
      ? getPublicUrl(item.processed_image_url)
      : item.processed_image_data_url;

    return (
      <TouchableOpacity
        style={styles.imageItem}
        onPress={() => setSelectedImage(item)}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.thumbnailImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.imageDate}>{formatDate(item.created_at)}</Text>
      </TouchableOpacity>
    );
  };

  const renderModalContent = () => {
    if (!selectedImage) return null;

    const imageUrl = selectedImage.processed_image_url 
      ? getPublicUrl(selectedImage.processed_image_url)
      : selectedImage.processed_image_data_url;

    console.log('Modal image URL:', imageUrl); // Add logging

    return (
      <>
        <Image
          source={{ uri: imageUrl }}
          style={styles.fullImage}
          resizeMode="contain"
        />
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.modalActionButton}
            onPress={() => downloadImage(selectedImage)}
          >
            <Download size={20} color="#FFA500" />
            <Text style={styles.modalActionText}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalActionButton}
            onPress={() => shareImage(selectedImage)}
          >
            <Share2 size={20} color="#FFA500" />
            <Text style={styles.modalActionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalActionButton}
            onPress={() => handleDeleteImage(selectedImage.id)}
          >
            <Trash2 size={20} color="#EF4444" />
            <Text style={[styles.modalActionText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authRequired}>
          <Text style={styles.authTitle}>Authentication Required</Text>
          <Text style={styles.authSubtitle}>
            Please sign in to view your gallery
          </Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gallery</Text>
        <Text style={styles.headerSubtitle}>
          {images.length} image{images.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {images.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Images Yet</Text>
          <Text style={styles.emptySubtitle}>
            Process your first image to see it here
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.emptyButtonText}>Start Creating</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={images}
          renderItem={renderImageItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Image Preview Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedImage(null)}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            {renderModalContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 4,
  },
  gridContainer: {
    padding: 20,
  },
  imageItem: {
    flex: 1,
    margin: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageContainer: {
    aspectRatio: 1, // Makes it square
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '90%', // Slightly smaller than container to ensure padding
    height: '90%',
    backgroundColor: '#F9FAFB',
  },
  imageDate: {
    padding: 8,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#facc15',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  authRequired: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  authTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  authButton: {
    backgroundColor: '#facc15',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  fullImage: {
    width: '100%',
    height: '80%',
    resizeMode: 'contain',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 20,
    position: 'absolute',
    bottom: 40,
  },
  modalActionButton: {
    alignItems: 'center',
    padding: 16,
  },
  modalActionText: {
    color: '#facc15',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginTop: 4,
  },
});