import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

const apiBase = String.fromEnvironment('API_URL', defaultValue: 'https://api.agroshop.uz');

Future<void> register(String email, String password) async {
  await FirebaseAuth.instance.createUserWithEmailAndPassword(email: email, password: password);
}

Future<void> deleteAccount() async {
  await http.delete(Uri.parse('$apiBase/me'));
  await FirebaseAuth.instance.currentUser?.delete();
}
