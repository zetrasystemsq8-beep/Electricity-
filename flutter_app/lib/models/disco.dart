class Disco {
  final String id;
  final String name;
  final String shortCode;
  Disco({required this.id, required this.name, required this.shortCode});

  factory Disco.fromJson(Map<String, dynamic> json) =>
      Disco(id: json['id'] as String, name: json['name'] as String, shortCode: json['shortCode'] as String);
}
