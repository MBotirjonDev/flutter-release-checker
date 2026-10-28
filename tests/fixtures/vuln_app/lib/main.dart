import 'package:firebase_auth/firebase_auth.dart';
import 'package:http/http.dart' as http;

const apiBase = 'http://10.0.2.2:8000/api';

Future<void> register(String email, String password) async {
  await FirebaseAuth.instance.createUserWithEmailAndPassword(email: email, password: password);
}

Future<String> loadProducts() async {
  final res = await http.get(Uri.parse('$apiBase/products'));
  return res.body;
}
