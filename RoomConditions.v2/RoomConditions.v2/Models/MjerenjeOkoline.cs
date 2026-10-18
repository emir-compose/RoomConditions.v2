namespace RoomConditions.v2.Models
{
    public class MjerenjeOkoline
    {
        public int Id { get; set; }

        public string DeviceId { get; set; } = "";

        public decimal TemperaturaC { get; set; }

        public decimal VlaznostZraka { get; set; }

        public DateTime DatumVrijemePrijemaUtc { get; set; }

        public bool KlimaUkljucena { get; set; }
    }
}
