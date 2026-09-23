class AppUser {
  final String id;
  final String phoneNumber;
  final String fullName;
  final String role;

  AppUser({required this.id, required this.phoneNumber, required this.fullName, required this.role});

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        phoneNumber: json['phoneNumber'] as String,
        fullName: json['fullName'] as String,
        role: json['role'] as String,
      );
}
