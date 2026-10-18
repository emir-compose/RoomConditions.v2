using Microsoft.EntityFrameworkCore;
using RoomConditions.v2.Models;

namespace RoomConditions.v2.Db
{
    public class MyDbContext : DbContext
    {
        public DbSet<MjerenjeOkoline> MjerenjaOkoline => Set<MjerenjeOkoline>();

        public MyDbContext(DbContextOptions<MyDbContext> options)
            : base(options)
        {
        }
    }
}
