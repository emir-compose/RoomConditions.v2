using System.ComponentModel.DataAnnotations;

namespace RoomConditions.v2.Dtos
{
    public class MjerenjeOkolineRequest
    {
        [Required]
        [StringLength(50)]
        public string DeviceId { get; set; } = "";

        [Range(0, 50)]
        public decimal TemperaturaC { get; set; }

        [Range(0, 100)]
        public decimal VlaznostZraka { get; set; }

        public bool KlimaUkljucena { get; set; }
    }
}
