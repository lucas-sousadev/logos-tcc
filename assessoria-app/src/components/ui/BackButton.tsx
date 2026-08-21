import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function BackButton(){
    const router = useRouter();

    return(
        <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            >
            <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
    )
}
const styles = StyleSheet.create({
    backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    },

    backButtonText: {
    fontSize: 36,
    color: "#1E5CCB",
    lineHeight: 40,
    },
});