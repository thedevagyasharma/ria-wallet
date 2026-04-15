import { Alert } from 'react-native';

/**
 * Mock biometric authentication for demo / review purposes.
 * Shows a native Alert instead of prompting Face ID or a real PIN,
 * so reviewers can tap through the feature without entering credentials.
 */
export function authenticate(promptMessage: string): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    Alert.alert(
      'Face ID',
      promptMessage,
      [
        { text: 'Cancel',       style: 'cancel', onPress: () => resolve({ success: false }) },
        { text: 'Authenticate',                  onPress: () => resolve({ success: true  }) },
      ],
      { cancelable: false },
    );
  });
}
